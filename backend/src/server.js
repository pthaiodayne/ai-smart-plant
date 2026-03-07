/**
 * Backend entry point.
 * TODO:
 * - Create the HTTP server using the app from `app.js`
 * - Load environment variables
 * - Connect to the database
 * - Add graceful shutdown if needed
 */

const { app } = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[backend] server stub is listening on port ${PORT}`);
});
