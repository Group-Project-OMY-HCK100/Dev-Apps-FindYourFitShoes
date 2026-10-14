import AuthForm from "../components/AuthForm";

export default function Login({ onAuthenticated, user, checking }) {
  return (
    <AuthForm
      onAuthenticated={onAuthenticated}
      user={user}
      checking={checking}
    />
  );
}
