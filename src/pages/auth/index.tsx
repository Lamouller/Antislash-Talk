import { Link } from 'react-router-dom';

export default function AuthIndex() {
  return (
    <div className="container">
      <h1 className="title">Welcome to Talk-2-Web</h1>
      <div className="buttonContainer">
        <Link to="/auth/login" className="buttonLink">
          <button className="button">
            <span className="buttonText">Sign In</span>
          </button>
        </Link>
        <Link to="/auth/register" className="buttonLink">
          <button className="button">
            <span className="buttonText">Create Account</span>
          </button>
        </Link>
      </div>
    </div>
  );
}