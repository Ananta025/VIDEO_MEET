import { useState, useContext } from "react";
import { User, Mail, Lock } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; 
import { UserContext } from "../contexts/userContext";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const { setUser } = useContext(UserContext);

  const navigate = useNavigate();

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    try{
      if(!name || !email || !password){
        setError("Please fill in all fields.");
        return;
      }
      if (!validateEmail(email)) {
        setError("Invalid email format.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      const newUser = {
        name,
        email,
        password
      }
      const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/users/register`, newUser);
      if(response.status === 201){
        console.log("User registered successfully");
        if(response.data.token){
          localStorage.setItem("token", response.data.token);
          
          // Store user data for offline access
          const userData = {
            id: response.data.data?._id || response.data.data?.id,
            name: response.data.data?.name || name,
            email: response.data.data?.email || email,
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
        // Clear fields only on success
        setName("");
        setEmail("");
        setPassword("");
        navigate('/home');
      }
    }catch(err: any){
      console.error("Registration error:", err);
      // Display the error message from the API response
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.data?.errors?.[0]?.msg) {
        setError(err.response.data.errors[0].msg);
      } else {
        setError("An error occurred during registration. Please try again.");
      }
      // Don't clear fields on error so user can fix and retry
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="w-full max-w-md p-8 rounded-3xl bg-black border border-gray-500">
        <h2 className="text-3xl font-bold text-center mb-5">Register</h2>
        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <label className="block text-sm font-medium">Name</label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full py-2 pr-10 bg-black border-b-2 border-white focus:outline-none focus:border-white text-white placeholder-gray-500"
                placeholder=""
              />
              <User className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white" size={20} />
            </div>
          </div>
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
            Register
          </button>
        </form>
        
        <p className="text-sm mt-6 text-center">
          Already have an account?{" "}
          <a href="/login" className="hover:underline font-semibold">Login</a>
        </p>
      </div>
    </div>
  );
}