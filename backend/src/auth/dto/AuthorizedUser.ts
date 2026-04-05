export interface AuthorizedUser {
  sub: string;
  userInfo: UserInfo;
}

export interface UserInfo {
  username: string;
}