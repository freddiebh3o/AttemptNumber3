import { Router } from "express";
import { prisma } from "../db";
import { z } from "zod";
import { badRequest, forbidden, notFound } from "../errors";
import type { Request } from "express";
import { validate } from "../middleware/validate";

// Schemas
const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional()
});

const updatePostSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional()
});

// Helpers
async function ensurePostInTenant(req: Request, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound("Post not found");
  if (post.tenantId !== req.context?.tenantId) throw forbidden("Cross-tenant access blocked");
  return post;
}

const router = Router({ mergeParams: true });

// GET /t/:tenantSlug/posts
router.get("/", async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const where: any = { tenantId: req.context?.tenantId };
    if (status) where.status = status;
    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, content: true, status: true,
        tenantId: true, authorId: true, createdAt: true, updatedAt: true
      }
    });
    res.json({ posts });
  } catch (e) { next(e); }
});

// POST /t/:tenantSlug/posts
router.post("/", validate(createPostSchema), async (req, res, next) => {
  try {
    if (!req.context?.user) throw forbidden("Auth required");
    const { tenantId } = req.context;
    const { title, content, status } = req.body as z.infer<typeof createPostSchema>;
    const post = await prisma.post.create({
      data: {
        tenantId,
        authorId: req.context.user.id,
        title,
        content,
        status: status ?? "DRAFT"
      },
      select: {
        id: true, title: true, content: true, status: true,
        tenantId: true, authorId: true, createdAt: true, updatedAt: true
      }
    });
    res.status(201).json({ post });
  } catch (e) { next(e); }
});

// PATCH /t/:tenantSlug/posts/:id
router.patch("/:id", validate(updatePostSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return next(badRequest("Missing post id"));

    await ensurePostInTenant(req, id);
    const updates = req.body as z.infer<typeof updatePostSchema>;
    const post = await prisma.post.update({
      where: { id },
      data: updates,
      select: {
        id: true, title: true, content: true, status: true,
        tenantId: true, authorId: true, createdAt: true, updatedAt: true
      }
    });
    res.json({ post });
  } catch (e) { next(e); }
});

// DELETE /t/:tenantSlug/posts/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await ensurePostInTenant(req, id);
    await prisma.post.delete({ where: { id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
