// services/feedState.js
let feed = null;
export function setFeedInstance(inst) { feed = inst || null; }
export function getFeedInstance() { return feed; }
