import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '../contexts/userContext';
import "../styles/Navbar.css";

export default function Navbar() {
    const navigate = useNavigate();
    const {user, setUser} = useContext(UserContext);
    const [showProfile, setShowProfile] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    // Display current time with update
    const [currentTime, setCurrentTime] = useState(new Date());
    
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute
        
        return () => clearInterval(timer);
    }, []);

    // Handle clicks outside profile dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.profile-picture') && !target.closest('.profile-content')) {
                setShowProfile(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem('token') || user?.token;
            
            if (!token) {
                console.log("No token found");
                setUser(null);
                localStorage.clear();
                navigate('/');
                return;
            }
    
            const response = await axios.post(
                `${import.meta.env.VITE_BASE_URL}/users/logout`, 
                {}, 
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
    
            if (response.status === 200) {
                console.log("User logged out successfully");
                localStorage.clear();
                setUser(null);
                navigate('/');
            }
        } catch (err) {
            console.error("Logout error:", err);
            // Still clear local data even if server request fails
            localStorage.clear();
            setUser(null);
            navigate('/');
        }
    }

    // Navigate to history page
    const navigateToHistory = (event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent this from triggering other click handlers
        navigate('/history');
    };

    // Toggle mobile menu
    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
        // Close profile dropdown when opening mobile menu
        if (!mobileMenuOpen) setShowProfile(false);
    };

    return (
        <>
            {/* Navigation Bar */}
            <div className="nav-bar sticky top-0 z-20 px-4 sm:px-6 md:px-8 lg:px-12 py-3 sm:py-4 flex justify-between items-center bg-background/95 backdrop-blur-sm border-b">
                <div className="nav-bar-left-content">
                    <h2
                    onClick={() => navigate('/home')}
                    className='cursor-pointer text-xl font-medium text-blue-600 dark:text-blue-400'>VideoMeet</h2>
                </div>
                
                {/* Desktop Navigation */}
                <div className="nav-bar-right-content hidden md:flex text-base lg:text-lg font-normal items-center gap-3 lg:gap-6">
                    <h2 className="whitespace-nowrap text-sm lg:text-base">
                        {currentTime.toLocaleString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        })} · {currentTime.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric'
                        })} · {currentTime.toLocaleString('en-US', {
                            weekday: 'long'
                        })}
                    </h2>
                    <button className="icon-button" aria-label="Settings">
                        <i className="fa-solid fa-gear hover:text-blue-600 dark:hover:text-blue-400 transition-colors"></i>
                    </button>
                    <button className="icon-button" aria-label="History" onClick={navigateToHistory}>
                        <i className="fa-solid fa-clock-rotate-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"></i>
                    </button>
                    <div className="profile-picture" onClick={() => setShowProfile(!showProfile)}>
                        <h2>{user?.name?.[0] || 'A'}</h2>
                    </div>
                </div>
                
                {/* Mobile menu button */}
                <div className="md:hidden flex items-center gap-2">
                    <button className="icon-button" aria-label="History" onClick={navigateToHistory}>
                        <i className="fa-solid fa-clock-rotate-left"></i>
                    </button>
                    <button className="icon-button" aria-label="Settings">
                        <i className="fa-solid fa-gear"></i>
                    </button>
                    <div className="profile-picture" onClick={() => setShowProfile(!showProfile)}>
                        <h2>{user?.name?.[0] || 'A'}</h2>
                    </div>
                    <button 
                        className="mobile-menu-button text-2xl p-1" 
                        onClick={toggleMobileMenu}
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? (
                            <i className="fa-solid fa-xmark"></i>
                        ) : (
                            <i className="fa-solid fa-bars"></i>
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile menu dropdown */}
            {mobileMenuOpen && (
                <div className="mobile-menu md:hidden fixed top-16 left-0 right-0 bg-background z-10 border-b shadow-md px-4 py-3 animate-in slide-in-from-top duration-300">
                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm">
                                {currentTime.toLocaleString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                })} · {currentTime.toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </h2>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile dropdown */}
            {showProfile && (
                <div className="profile-content h-auto w-64 border border-border bg-background absolute top-16 right-4 sm:right-8 rounded-lg z-30 flex flex-col p-2 shadow-lg">
                    <div className="dropdown-item" onClick={navigateToHistory}>
                        <i className="fa-solid fa-clock-rotate-left"></i>
                        <h2>History</h2>
                    </div>
                    <div className="dropdown-item">
                        <i className="fa-solid fa-pencil"></i>
                        <h2>Customize profile</h2>
                    </div>
                    <div className="dropdown-item">
                        <i className="fa-solid fa-user-plus"></i>
                        <h2>Add another account</h2>
                    </div>
                    <div className="dropdown-item" onClick={handleLogout}>
                        <i className="fa-solid fa-right-from-bracket"></i>
                        <h2>Logout</h2>
                    </div>
                </div>
            )}
        </>
    )
}
