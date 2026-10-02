const { handleRequest } = require('../server');

module.exports = (req, res) => {
  const route = req.query?.route || new URL(req.url, 'http://localhost').searchParams.get('route');
  if (route) {
    const value = Array.isArray(route) ? route.join('/') : String(route);
    req.url = value === 'health' ? '/health' : `/api/${value}`;
  }
  return handleRequest(req, res);
};
