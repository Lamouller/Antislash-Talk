import { useNavigate } from 'react-router-dom';

export default function MeetingRedirect() {
    const navigate = useNavigate();
    
    navigate('/tabs/meetings');
    
    return null;
}