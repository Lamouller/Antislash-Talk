import { Link } from 'react-router-dom';

export default function HomeScreen() {
  return (
    <div className="container">
      <h1 className="title">Welcome to Talk-2-Web</h1>
      <p className="subtitle">Your AI-powered meeting assistant</p>
      <Link to="/auth" style={{ textDecoration: 'none' }}>
        <button className="button">
          <span className="buttonText">Get Started</span>
        </button>
      </Link>
    </div>
  );
}