export interface ListenerHandlers {
    onIssueChanged: (issue: string) => void;
    onUserJoined: (username: string) => void;
    onUserLeft: (username: string) => void;
    onUserChoseCard: (username: string, card: string) => void;
}
