import { useState, useContext, useEffect } from "react";
import { Mail, Lock } from "lucide-react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../contexts/userContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useContext(UserContext);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Check for redirect path on component mount
  useEffect(() => {
    const savedRedirectPath = localStorage.getItem('redirectAfterLogin');
    
    // Get redirect path from state (if navigated from protected route)
    const stateRedirectPath = location.state?.from;
    
    // Use path from state or localStorage
    if (stateRedirectPath) {
      setRedirectPath(stateRedirectPath);
    } else if (savedRedirectPath) {
      setRedirectPath(savedRedirectPath);
    }
  }, [location]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try{
        if(!email || !password){
            setError("Please fill in all fields.");
            return;
        }
        if (!validateEmail(email)) {
            setError("Invalid email format.");
            return;
        }
        const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/users/login`, {email, password});
        console.log(response.data);
        if(response.status === 200){
            console.log("User logged in successfully");
            // localStorage.setItem("user", JSON.stringify(response.data));
            if(response.data.token){
                localStorage.setItem("token", response.data.token);
                
                // Store user data for offline access
                const userData = {
                  id: response.data.data._id || response.data.data.id,
                  name: response.data.data.name,
                  email: response.data.data.email,
                  token: response.data.token
                };
                localStorage.setItem("userData", JSON.stringify(userData));
            }
            setUser(response.data);
            if(rememberMe){
                localStorage.setItem("rememberMe", "true");
            }else{
                localStorage.removeItem("rememberMe");
            }
            
            // Clear the redirectAfterLogin from localStorage after using it
            if (redirectPath) {
                localStorage.removeItem('redirectAfterLogin');
                navigate(redirectPath);
            } else {
                navigate('/home');
            }
        }
    }catch(err: any){
      console.log(err);
      // Display the error message from the API response
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError("An error occurred during login. Please try again.");
      }
      // Don't clear email/password on error so user can fix and retry
      return;
    }
    setEmail("");
    setPassword("");
  };

  // Show a message if the user was redirected from a meeting
  const wasMeetingRedirected = redirectPath && redirectPath.includes('meeting');

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="w-full max-w-md p-8 rounded-3xl bg-black border border-gray-500">
            <h2 className="text-3xl font-bold text-center mb-10">Login</h2>
            
            {/* Add message when redirected from meeting */}
            {wasMeetingRedirected && (
              <div className="bg-blue-900/70 p-3 rounded-md mb-4 text-center">
                You need to be logged in to join a meeting. Please login to continue.
              </div>
            )}
            
            {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                    <label className="block text-sm font-medium">Email</label>
                    <div className="relative">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full py-2 pr-10 bg-black border-b-2 border-white focus:outline-none focus:border-white text-white placeholder-gray-500"
                            placeholder=""
                        />
                        <Mail className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white" size={20} />
                    </div>
                </div>
                <div className="relative">
                    <label className="block text-sm font-medium">Password</label>
                    <div className="relative">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full py-2 pr-10 bg-black border-b-2 border-white focus:outline-none focus:border-white text-white placeholder-gray-500"
                            placeholder=""
                        />
                        <Lock className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white" size={20} />
                    </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={() => setRememberMe(!rememberMe)}
                            className="w-4 h-4 rounded bg-black border-white cursor-pointer"
                        />
                        <span>Remember me</span>
                    </label>
                    <a href="#" className="hover:underline">Forgot Password?</a>
                </div>
                <button
                    type="submit"
                    className="w-full bg-white hover:bg-gray-200 text-black font-bold py-3 rounded-full transition"
                >
                    Login
                </button>
            </form>
            
            <p className="text-sm mt-6 text-center">
                Don't have an account?{" "}
                <a href="/register" className="hover:underline font-semibold">Signup now</a>
            </p>
        </div>
    </div>
  );
}