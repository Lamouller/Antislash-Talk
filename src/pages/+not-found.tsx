import { Link } from 'react-router-dom';

export default function NotFoundScreen() {
  return (
    <div className="container">
      <h1 className="title">This screen doesn't exist.</h1>
      <Link to="/" className="link">
        <p className="linkText">Go to home screen!</p>
      </Link>
    </div>
  );
}