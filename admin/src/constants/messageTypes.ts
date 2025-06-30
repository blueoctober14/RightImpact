export const MESSAGE_TYPES = {
  friend_to_friend: 'Friend to Friend',
  neighbor_to_neighbor: 'Neighbor to Neighbor',
  social_media: 'Social Media'
} as const;

export type MessageType = keyof typeof MESSAGE_TYPES;
