// Shared by the topic pickers (email dialog, PDF dialog). Plain functions, no server code.

export type TopicGroup = 'scientific' | 'workshop';

export type TopicChoice = {
  topicId: string;
  session: string;
  title: string;
  role: string;
  hall: string;
  time: string;
  group: TopicGroup;
  confirmed?: boolean;
  isNew?: boolean;
};

export const GROUP_LABEL: Record<TopicGroup, string> = {
  scientific: 'Scientific sessions',
  workshop: 'Workshops',
};

export const GROUP_ORDER: TopicGroup[] = ['scientific', 'workshop'];

/** Topics split under their heading (Scientific sessions, Workshops); empty headings are left out */
export function groupChoices(choices: TopicChoice[]): { group: TopicGroup; label: string; topics: TopicChoice[] }[] {
  return GROUP_ORDER
    .map((group) => ({
      group,
      label: GROUP_LABEL[group],
      topics: choices
        .filter((c) => c.group === group)
        .sort((a, b) => a.session.localeCompare(b.session, undefined, { numeric: true })),
    }))
    .filter((g) => g.topics.length > 0);
}

export function allTopicIds(choices: TopicChoice[]): Set<string> {
  return new Set(choices.map((c) => c.topicId));
}

/** What to send to the server: nothing (= everything) when every topic is ticked, otherwise the ticked ids */
export function selectionToIds(choices: TopicChoice[], selected: Set<string>): string[] | undefined {
  const ids = choices.filter((c) => selected.has(c.topicId)).map((c) => c.topicId);
  return ids.length === choices.length ? undefined : ids;
}

/** Sender that normally fits a selection: Scientific Committee when only scientific topics are ticked */
export function suggestedSender(choices: TopicChoice[], selected: Set<string>): 'workshop' | 'scientific' {
  const ticked = choices.filter((c) => selected.has(c.topicId));
  return ticked.length > 0 && ticked.every((c) => c.group === 'scientific') ? 'scientific' : 'workshop';
}
