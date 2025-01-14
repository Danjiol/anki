const axios = require('axios');

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the incoming request body
    const payload = JSON.parse(event.body);

    // Forward the request to the Python Anywhere API
    const response = await axios.post(
      'https://dianjeol.pythonanywhere.com/api/convert-direct',
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    // Return the response with appropriate headers
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${payload.deck_name || 'Anki-Cards'}.apkg"`
      },
      body: Buffer.from(response.data).toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({
        error: error.response?.data?.error || 'Internal server error'
      })
    };
  }
}; 