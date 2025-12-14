export default {
  async fetch(request, env, ctx) {
    return new Response(
      'This proxy has been deprecated and moved to https://proxy-us.sgl.as\n\n' +
      'Please update your integration to use the new endpoint.\n\n' +
      'Same API - just change the base URL.\n',
      {
        status: 410, // Gone
        headers: {
          'Content-Type': 'text/plain',
          'X-Deprecated': 'true',
          'X-New-Location': 'https://proxy-us.sgl.as'
        }
      }
    );
  }
};
