export const ERR_ROOM_NOT_FOUND = (id: number) => `Could not connect to room with ID ${id}.`;
export const ERR_INVALID_TOKEN = () => "The passed token is invalid.";
export const ERR_ILLEGAL_USERNAME = (username: string) => `The username '${username}' is not allowed.`;
export const ERR_INVALID_CARD = (card: string) => `The card '${card}' is not allowed.`;
