// ============================================================
// W2.6 — Neighbor messaging (verified-only, template-only, T&S).
// Exercises the two presentational screens directly: compose is
// template-only (radio notes, no text input, anonymized delivery copy)
// and gated to a recipient; received shows the templated reply path plus
// the always-present block / report controls. Pure views with mock data.
// ============================================================

import { render, screen, fireEvent } from '@testing-library/react';
import type {
  NeighborMessageTemplate,
  NeighborReplyTemplate,
  ReceivedNeighborMessage,
} from '@pantopus/api';
import NeighborMessageComposeView from '@/components/place/neighbor-message/NeighborMessageComposeView';
import NeighborMessageReceivedView from '@/components/place/neighbor-message/NeighborMessageReceivedView';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/app/place/neighbor-message',
}));

const TEMPLATES: NeighborMessageTemplate[] = [
  { id: 'noise', icon: 'volume-2', category: 'Late-night noise', body: 'A verified neighbor mentioned some noise after 10pm.' },
  { id: 'package', icon: 'package', category: 'Misdelivered package', body: 'A package may have been left at the wrong door near you.' },
];

const REPLIES: NeighborReplyTemplate[] = [
  { id: 'thanks', body: 'Thanks for the heads-up' },
  { id: 'will_check', body: "Got it — I'll check" },
];

function received(overrides: Partial<ReceivedNeighborMessage> = {}): ReceivedNeighborMessage {
  return {
    id: 'demo',
    category: 'Misdelivered package',
    body: 'A package may have been left at the wrong door near you.',
    created_at: new Date().toISOString(),
    sender: { label: 'A verified neighbor nearby', block_label: 'On your block', verified: true },
    reply: null,
    can_reply: true,
    not_helpful: false,
    reported: false,
    read_at: null,
    ...overrides,
  };
}

describe('NeighborMessageComposeView — template-only compose', () => {
  it('renders the recipient by address, the anonymity promise, and no free-text input', () => {
    const { container } = render(
      <NeighborMessageComposeView
        templates={TEMPLATES}
        recipient={{ address: '1425 SE Oak St', relativeLabel: 'Two doors down · on your block' }}
        selectedId="package"
        onSelect={() => {}}
        onSend={() => {}}
        onChangeRecipient={() => {}}
        sending={false}
      />
    );

    expect(screen.getByText('1425 SE Oak St')).toBeInTheDocument();
    expect(screen.getByText(/from a verified neighbor nearby/i)).toBeInTheDocument();
    // Template-only: there must be no free-text field anywhere.
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
    // Each template renders as a selectable note.
    expect(screen.getByText('Late-night noise')).toBeInTheDocument();
    expect(screen.getByText('Misdelivered package')).toBeInTheDocument();
  });

  it('enables Send only with a recipient + a selected note', () => {
    const onSend = jest.fn();
    const { rerender } = render(
      <NeighborMessageComposeView
        templates={TEMPLATES}
        recipient={null}
        selectedId={null}
        onSelect={() => {}}
        onSend={onSend}
        onChangeRecipient={() => {}}
        sending={false}
      />
    );
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();

    rerender(
      <NeighborMessageComposeView
        templates={TEMPLATES}
        recipient={{ address: '1425 SE Oak St', relativeLabel: 'On your block' }}
        selectedId="package"
        onSelect={() => {}}
        onSend={onSend}
        onChangeRecipient={() => {}}
        sending={false}
      />
    );
    const enabled = screen.getByRole('button', { name: /send/i });
    expect(enabled).not.toBeDisabled();
    fireEvent.click(enabled);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});

describe('NeighborMessageReceivedView — calm, in-control receiving', () => {
  it('shows the anonymized sender and templated quick-replies when allowed', () => {
    const onReply = jest.fn();
    render(
      <NeighborMessageReceivedView
        message={received()}
        replies={REPLIES}
        onReply={onReply}
        onChangeReply={() => {}}
        onNotHelpful={() => {}}
        onBlock={() => {}}
        onReport={() => {}}
        replying={false}
        flags={{ notHelpful: false, blocked: false, reported: false }}
        editingReply={false}
      />
    );

    expect(screen.getByText('From a verified neighbor nearby')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thanks for the heads-up' }));
    expect(onReply).toHaveBeenCalledWith('thanks');
  });

  it('always exposes block and report controls', () => {
    const onBlock = jest.fn();
    const onReport = jest.fn();
    render(
      <NeighborMessageReceivedView
        message={received({ can_reply: false })}
        replies={REPLIES}
        onReply={() => {}}
        onChangeReply={() => {}}
        onNotHelpful={() => {}}
        onBlock={onBlock}
        onReport={onReport}
        replying={false}
        flags={{ notHelpful: false, blocked: false, reported: false }}
        editingReply={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Block this neighbor/i }));
    fireEvent.click(screen.getByRole('button', { name: /Report this message/i }));
    expect(onBlock).toHaveBeenCalledTimes(1);
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it('shows the sent-reply confirmation (with Change reply) once replied', () => {
    render(
      <NeighborMessageReceivedView
        message={received({ reply: { template_id: 'thanks', body: 'Thanks for the heads-up', replied_at: new Date().toISOString() }, can_reply: false })}
        replies={REPLIES}
        onReply={() => {}}
        onChangeReply={() => {}}
        onNotHelpful={() => {}}
        onBlock={() => {}}
        onReport={() => {}}
        replying={false}
        flags={{ notHelpful: false, blocked: false, reported: false }}
        editingReply={false}
      />
    );

    expect(screen.getByText('Reply sent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change reply/i })).toBeInTheDocument();
  });
});
