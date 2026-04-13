module.exports = ({ env }) => ({
  url: '/admin',
  serveAdminPanel: env('SERVE_ADMIN_PANEL', true),
});
