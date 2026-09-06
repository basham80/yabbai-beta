(() => {
  const endpoint = '/api/owner-ai';
  const $ = (id) => document.getElementById(id);
  function show(text, kind = '') { const el = $('ownerAiResponse'); el.textContent = text; el.className = `owner-ai-response ${kind}`; }
  async function request(body) {
    const res = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  $('ownerAiLogin').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('ownerAiPassword').value;
    $('ownerAiLoginButton').disabled = true;
    show('Authenticating owner session…');
    try { await request({ mode: 'login', password }); $('ownerAiLogin').hidden = true; $('ownerAiWorkspace').hidden = false; show('Owner session active. Claude can analyze this site; blockchain actions remain preview-only until you sign in your wallet.','success'); }
    catch (error) { show(error.message, 'error'); }
    finally { $('ownerAiLoginButton').disabled = false; }
  });
  $('ownerAiForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const prompt = $('ownerAiPrompt').value.trim();
    if (!prompt) return;
    $('ownerAiRun').disabled = true;
    show('Claude is reviewing the private operations context…');
    try { const data = await request({ prompt, action: 'analysis', wallet: window.walletPubkey || null }); show(data.text || 'No analysis returned.', 'success'); }
    catch (error) { show(error.message, 'error'); if (error.message.includes('session')) { $('ownerAiLogin').hidden = false; $('ownerAiWorkspace').hidden = true; } }
    finally { $('ownerAiRun').disabled = false; }
  });
  $('ownerAiPreview').addEventListener('click', async () => {
    try { const data = await request({ action: 'prepare_mint_preview' }); show(`${data.message}\n\nSafety constraints: mint authority must be active, amount is currently capped at ${data.constraints.maxAmount}, and a wallet signature is required.`, 'success'); }
    catch (error) { show(error.message, 'error'); }
  });
})();
