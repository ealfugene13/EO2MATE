export function facebookPostUrl(fbPostId) {
  const raw = String(fbPostId || "").trim();
  if (!raw) return null;

  const [pageId, postId, ...rest] = raw.split("_");
  if (pageId && postId && rest.length === 0) {
    return `https://www.facebook.com/${encodeURIComponent(pageId)}/posts/${encodeURIComponent(postId)}`;
  }

  return `https://www.facebook.com/${encodeURIComponent(raw)}`;
}
