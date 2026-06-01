export const AUTH_PATHS = [
  "/login",
  "/signup",
  "/confirm-email",
  "/forgot-password",
  "/reset-password",
];

export const isAuthPath = (pathname) => AUTH_PATHS.includes(pathname);
