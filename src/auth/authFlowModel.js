export const sessionRequiresPasswordSetup = (candidate) => (
  candidate?.user?.user_metadata?.password_setup_required === true
);
