// Minimal ambient declaration for the optional `webtorrent` dependency.
// We intentionally avoid @types/webtorrent (heavy, drifts from runtime) and the
// engine module narrows to the small surface it actually uses.
declare module 'webtorrent';
