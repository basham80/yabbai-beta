/**
 * Netlify Functions shim — shared logic in /lib/mission-logic.mjs
 */
exports.handler = async (event) => {
  const { handleNetlify } = await import('../../lib/mission-logic.mjs');
  return handleNetlify(process.env, event);
};
