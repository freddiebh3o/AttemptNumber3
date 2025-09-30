// admin-web/src/components/nav/DirtyNavigationGuard.tsx
import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Group, Text } from '@mantine/core';
import * as RRD from 'react-router-dom';
import { useDirtyStore } from '../../stores/dirty';

// ---- Version-compatible blocker ----
// 1) Prefer react-router's hook if present
// 2) Fallback: intercept internal anchor clicks and prompt
function useCompatibleBlocker(when: boolean) {
  const anyRRD = RRD as any;
  const builtin =
    (anyRRD.useBlocker as undefined | ((w: boolean) => any)) ??
    (anyRRD.unstable_useBlocker as undefined | ((w: boolean) => any));

  if (typeof builtin === 'function') {
    const b = builtin(when);
    return {
      state: b.state as 'blocked' | 'unblocked',
      proceed: () => b.proceed(),
      reset: () => b.reset(),
    };
  }

  // ---- Fallback (Data Router without a blocker hook) ----
  const navigate = RRD.useNavigate();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!when) return;

    function onClickCapture(e: MouseEvent) {
      if (!when) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return; // only left click
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      // bubble up to nearest <a>
      let el = e.target as HTMLElement | null;
      while (el && el.tagName !== 'A') el = el.parentElement;
      if (!el) return;

      const a = el as HTMLAnchorElement;
      const href = a.getAttribute('href') || '';
      const target = a.getAttribute('target') || '';

      // ignore new tabs, downloads, mailto, tel, empty
      if (!href || target === '_blank' || a.hasAttribute('download')) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

      // same-origin internal link?
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;

      // At this point it's an internal nav — block & remember destination
      e.preventDefault();
      setPendingHref(url.pathname + url.search + url.hash);
    }

    // capture phase to intercept before Link does
    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [when]);

  return useMemo(
    () => ({
      state: when && pendingHref ? ('blocked' as const) : ('unblocked' as const),
      proceed: () => {
        if (pendingHref) navigate(pendingHref);
        setPendingHref(null);
      },
      reset: () => setPendingHref(null),
    }),
    [when, pendingHref, navigate]
  );
}

export default function DirtyNavigationGuard() {
  const { isDirty, reason, saveHandler, saving, _setSaving } = useDirtyStore();
  const blocker = useCompatibleBlocker(isDirty);
  const [opened, setOpened] = useState(false);

  // Open/close modal when a navigation is blocked
  useEffect(() => {
    setOpened(blocker.state === 'blocked');
  }, [blocker.state]);

  // Native browser/tab close prompt
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = ''; // required by some browsers to show the prompt
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  function handleLeave() {
    blocker.proceed(); // navigate away
    setOpened(false);
  }

  function handleCancel() {
    blocker.reset();   // stay here
    setOpened(false);
  }

  async function handleSaveAndLeave() {
    if (!saveHandler) return handleLeave(); // nothing to save -> just leave
    try {
      _setSaving(true);
      await Promise.resolve(saveHandler());
      blocker.proceed(); // go to the original destination
    } finally {
      _setSaving(false);
      setOpened(false);
    }
  }

  if (blocker.state === 'unblocked') return null;

  return (
    <Modal opened={opened} onClose={handleCancel} title="Unsaved changes" centered size="sm">
      <Text mb="md">
        {reason ?? 'Are you sure you want to leave this page? You will lose any unsaved changes.'}
      </Text>
      <Group align="center" justify="space-between">
        <Group>
          <Button variant="default" onClick={handleCancel} disabled={saving}>Cancel</Button>
          <Button variant="light" color="red" onClick={handleLeave} disabled={saving}>Leave</Button>
        </Group>

        <Group>
          <Button onClick={handleSaveAndLeave} loading={saving}>Save &amp; leave</Button>
        </Group>
      </Group>
    </Modal>
  );
}
