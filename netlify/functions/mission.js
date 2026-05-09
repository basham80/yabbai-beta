/**
 * Netlify Functions shim — shared logic in /api/mission-logic.mjs
 */
exports.handler = async (event) => {
  const { handleNetlify } = await import('../../api/mission-logic.mjs');
  return handleNetlify(process.env, event);
};
