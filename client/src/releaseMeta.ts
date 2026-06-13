export type ClientReleaseMeta = {
  commit: string | null;
  commitShort: string | null;
  builtAt: string | null;
};

declare const __CLIENT_RELEASE_META__: ClientReleaseMeta;

export const CLIENT_RELEASE_META: ClientReleaseMeta = __CLIENT_RELEASE_META__;
