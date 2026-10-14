import AuthForm from "../components/AuthForm";

export default function Register({ onAuthenticated, user, checking }) {
  return (
    <AuthForm
      register
      onAuthenticated={onAuthenticated}
      user={user}
      checking={checking}
    />
  );
}
