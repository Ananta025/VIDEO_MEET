import { useContext, useState, useEffect } from 'react'
import { UserContext } from '../contexts/userContext'
import { useNavigate } from 'react-router-dom';
import "../styles/HomePage.css";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
  } from "@/components/ui/carousel"
import { useAppDispatch } from '@/app/hooks';
import { createMeeting, addMeetingToHistory } from '@/features/meeting/meetingSlice';
import Navbar from '@/components/Navbar';
  

export default function HomePage() {
    const navigate = useNavigate();
    const {user} = useContext(UserContext);
    const [meetingCode, setMeetingCode] = useState('')
    const dispatch = useAppDispatch();
    
    // Check authentication on component mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
        }
    }, [navigate]);
   
    // Create a new meeting
    const handleNewMeeting = async () => {
        try {
            // Create meeting via Redux - this sets meetingId and isHost in store
            dispatch(createMeeting());
            
            // Generate meeting ID (same logic as in the slice)
            const meetingId = `meeting-${Math.random().toString(36).substring(2, 9)}`;
            
            // Add meeting to history (fire and forget - doesn't block navigation)
            dispatch(addMeetingToHistory({
                title: `Meeting ${new Date().toLocaleString()}`,
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour default
                meetingLink: `${window.location.origin}/meeting/${meetingId}`,
                status: 'ongoing'
            }));
            
            // Navigate to meeting room with the correct path
            navigate(`/meeting/${meetingId}`);
        } catch (error) {
            console.error("Error creating meeting:", error);
            // Show error message to user if needed
        }
    };
    
    // Join existing meeting
    const handleJoinMeeting = () => {
        if (meetingCode) {
            // If user entered a complete URL, extract just the meeting ID
            if (meetingCode.includes('/meeting/')) {
                const meetingId = meetingCode.split('/meeting/')[1];
                navigate(`/meeting/${meetingId}`);
            } else {
                // Otherwise use the code directly
                navigate(`/meeting/${meetingCode}`);
            }
        }
    };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
        {/* Navbar Component */}
        <Navbar />

        {/* Main Content */}
        <div className="main-content container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
            {/* Mobile view - Controls first, image second */}
            <div className="sm:hidden flex flex-col items-center gap-8">
                {/* Call Controls Section (Mobile) */}
                <div className="w-full text-center">
                    <h2 className='heading font-bold text-2xl'>Premium video meetings</h2>
                    <h2 className='heading font-bold text-2xl'>Now free for everyone</h2>
                    <p className='heading-small mt-8 text-muted-foreground text-sm'>We re-engineered the service we built for secure business meetings, Google Meet, to make it free and available for all.</p>
                    
                    <div className="meeting-controls mt-7 flex flex-col items-center gap-5">
                        <button className='new-meeting-button w-full' onClick={handleNewMeeting}>
                            <i className="fa-solid fa-square-plus"></i>
                            <span>New meeting</span>
                        </button>
                        
                        <div className="w-full flex flex-row items-center gap-2">
                            <div className="meeting-code-input flex-1 flex items-center bg-background border border-input rounded-md px-3 py-2 focus-within:ring-1 focus-within:ring-blue-500">
                                <i className="fa-solid fa-keyboard text-muted-foreground mr-2"></i>
                                <input 
                                    type="text" 
                                    placeholder="Enter a code or link" 
                                    className='outline-none flex-1 min-w-0 bg-transparent text-sm'
                                    value={meetingCode}
                                    onChange={(e) => setMeetingCode(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleJoinMeeting()}
                                />
                            </div>
                            <button 
                                className={`join-button whitespace-nowrap px-3 border rounded-md transition-colors ${meetingCode ? 'bg-secondary hover:bg-secondary/80 text-secondary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`} 
                                onClick={handleJoinMeeting}
                                disabled={!meetingCode}
                            >
                                Join
                            </button>
                        </div>
                    </div>
                </div>

                {/* Carousel Section (Mobile) */}
                <div className="w-full flex flex-col items-center">
                    <Carousel className='carousel w-full max-w-xs'>
                        <CarouselContent className='carousel-content flex justify-between items-center'>
                            <CarouselItem>
                                <div className='carousel-image h-48 w-48 rounded-full overflow-hidden mx-auto'>
                                    <img src="./photo2.jpg" alt="Video meeting" className="w-full h-full object-cover" />
                                </div>
                            </CarouselItem>
                            <CarouselItem>
                                <div className='carousel-image h-48 w-48 rounded-full overflow-hidden mx-auto'>
                                    <img src="./photo1.jpg" alt="Video meeting" className="w-full h-full object-cover" />
                                </div>
                            </CarouselItem>
                            <CarouselItem>
                                <div className='carousel-image h-48 w-48 rounded-full overflow-hidden mx-auto'>
                                    <img src="./photo3.jpg" alt="Video meeting" className="w-full h-full object-cover" />
                                </div>
                            </CarouselItem>
                            <CarouselItem>
                                <div className='carousel-image h-48 w-48 rounded-full overflow-hidden mx-auto'>
                                    <img src="./photo4.jpg" alt="Video meeting" className="w-full h-full object-cover" />
                                </div>
                            </CarouselItem>
                        </CarouselContent>
                        <div className="carousel-controls flex justify-center gap-2 mt-5">
                            <CarouselPrevious className="static transform-none" />
                            <CarouselNext className="static transform-none" />
                        </div>
                    </Carousel>
                    <div className="carousel-caption w-full max-w-xs text-center mt-4">
                        <p className="text-xs sm:text-sm">Click <span className='font-medium text-base'>New meeting</span> to get a link you can send to people you want to meet with</p>
                    </div>
                </div>
            </div>

            {/* Desktop/tablet view - Side by side layout */}
            <div className="hidden sm:flex flex-col md:flex-row justify-between items-center gap-8 lg:gap-12">
                <div className="left-side-content w-full md:w-1/2 text-center md:text-left order-2 md:order-1">
                    <h2 className='heading font-bold text-2xl sm:text-3xl md:text-3xl lg:text-4xl'>Premium video meetings</h2>
                    <h2 className='heading font-bold text-2xl sm:text-3xl md:text-3xl lg:text-4xl'>Now free for everyone</h2>
                    <p className='heading-small mt-6 sm:mt-8 text-muted-foreground text-sm sm:text-base'>We re-engineered the service we built for secure business meetings,</p>
                    <p className='heading-small text-muted-foreground text-sm sm:text-base'>Google Meet, to make it free and available for all.</p>
                    
                    <div className="meeting-controls mt-7 sm:mt-8 flex flex-col sm:flex-row items-center gap-4">
                        <button className='new-meeting-button sm:w-auto' onClick={handleNewMeeting}>
                            <i className="fa-solid fa-square-plus"></i>
                            <span>New meeting</span>
                        </button>
                        <div className="meeting-code-input w-full sm:w-auto flex items-center bg-background border border-input rounded-md px-3 py-2 focus-within:ring-1 focus-within:ring-blue-500">
                            <i className="fa-solid fa-keyboard text-muted-foreground mr-2"></i>
                            <input 
                                type="text" 
                                placeholder="Enter a code or link" 
                                className='outline-none flex-1 min-w-0 bg-transparent'
                                value={meetingCode}
                                onChange={(e) => setMeetingCode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoinMeeting()}
                            />
                        </div>
                        <button 
                            className={`join-button px-6 border rounded-md transition-colors ${meetingCode ? 'bg-secondary hover:bg-secondary/80 text-secondary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`} 
                            onClick={handleJoinMeeting}
                            disabled={!meetingCode}
                        >
                            Join
                        </button>
                    </div>
                    
                    <div className="mt-6 sm:mt-8 border-b border-border w-full md:w-10/12"></div>
                    <p className='mt-4 sm:mt-6 text-sm sm:text-base'><span className='text-blue-500 cursor-pointer hover:text-blue-600'>Learn more </span>about Video Meet</p>
                </div>
                
                <div className="right-side-content w-full sm:w-3/4 md:w-1/2 lg:w-5/12 order-1 md:order-2 flex flex-col items-center">
                    <Carousel className='carousel w-full max-w-xs sm:max-w-sm md:max-w-md'>
                        <CarouselContent className='carousel-content flex justify-between items-center'>
                            <CarouselItem>
                                <div className='carousel-image h-56 w-56 sm:h-64 sm:w-64 md:h-64 md:w-64 lg:h-80 lg:w-80 rounded-full overflow-hidden mx-auto'>
                                    <img src="./photo2.jpg" alt="Video meeting" className="w-full h-full object-cover" />
                                </div>
                            </CarouselItem>
                            <CarouselItem>
                                <div className='carousel-image h-56 w-56 sm:h-64 sm:w-64 md:h-64 md:w-64 lg:h-80 lg:w-80 rounded-full overflow-hidden mx-auto'>
                                    <img src="./photo1.jpg" alt="Video meeting" className="w-full h-full object-cover" />
                                </div>
                            </CarouselItem>
                            <CarouselItem>
                                <div className='carousel-image h-56 w-56 sm:h-64 sm:w-64 md:h-64 md:w-64 lg:h-80 lg:w-80 rounded-full overflow-hidden mx-auto'>
                                    <img src="./photo3.jpg" alt="Video meeting" className="w-full h-full object-cover" />
                                </div>
                            </CarouselItem>
                            <CarouselItem>
                                <div className='carousel-image h-56 w-56 sm:h-64 sm:w-64 md:h-64 md:w-64 lg:h-80 lg:w-80 rounded-full overflow-hidden mx-auto'>
                                    <img src="./photo4.jpg" alt="Video meeting" className="w-full h-full object-cover" />
                                </div>
                            </CarouselItem>
                        </CarouselContent>
                        <div className="carousel-controls flex justify-center gap-2 mt-6">
                            <CarouselPrevious className="static transform-none" />
                            <CarouselNext className="static transform-none" />
                        </div>
                    </Carousel>
                    <div className="carousel-caption w-full max-w-xs sm:max-w-sm md:max-w-md text-center mt-5">
                        <p className="text-xs sm:text-sm">Click <span className='font-medium text-base lg:text-lg'>New meeting</span> to get a link you can send to people you want to meet with</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  )
}
