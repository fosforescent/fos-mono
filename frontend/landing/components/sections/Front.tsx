// import { useState } from 'react'
import imageUrl from '@/assets/space-1278869_1920.jpg';
import { useEffect } from 'react';
// import Background2 from '../background2';
import { ChevronDownIcon } from '@radix-ui/react-icons';

export default function Front() {
  
  useEffect(() => {
    console.log('loaded')
    setTimeout(() => document.getElementById("front-load")?.classList.remove("not-loaded"), 100) ;
  }, [])

  return (
    <div id="front-load" style={{
      width: '100%',
      boxSizing: 'border-box',
      backgroundImage: `url('${imageUrl}')`,
      backgroundColor: 'transparent',
      backgroundSize: 'cover',
      // opacity: 1,
      position: 'relative',
    }} className={"not-loaded content-container"}>

    <div className="register-content" style={{
      zIndex: 7,
      position: 'absolute',
      top: 0,
      left: 0,    
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      display: 'flex',
      justifyContent: 'center',
      textAlign: 'center',      
      }}>

        <div style={{

        }} className="items-center">
          <div style={{
            padding: '50px',
            backgroundColor: 'rgba(0,0,0,.5)',
            backgroundClip: 'text',

            mixBlendMode: 'screen',
          }} className='text-white '>
            <h1 style={{
              fontSize: '40px',
              // textShadow: '0 1px 1px hsl(169, 100%, 57%)',
              fontFamily: 'sans-serif',
            }}> Fosforescent </h1>
            <div style={{

            }}
            className={`text-fosorange`}> 
              Work together with less human error
            </div>
          </div>
          </div>
   
    </div>

    <div style={{
        width: '100%',
        height: '50px',
        position: 'fixed',
        padding: '20px',
        zIndex: 2,
        bottom: '0',
        textAlign: 'center',
      }} className="content-center" id="scroll-down-button" onClick={() => window.scrollBy(10, 0)}>
        <div style={{
          margin: '0 auto',
          textAlign: 'center',
          width: '30px',
          fontSize: '30px',
        }}><ChevronDownIcon height='20px' width='20px'/></div>
      </div>

    <div  style={{
      width: '100%',
      height: "100%",
      boxSizing: 'border-box',
      background: `radial-gradient(circle at 40% 40%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 33%, rgba(224,114,29,.05) 40%, rgba(0,0,0,0) 50%, rgba(0,0,0,0) 100%) `,
      backgroundSize: 'cover',
      zIndex: 3,
      position: 'absolute',
      top: 0,
      left: 0,
      }}>

      &nbsp;

    </div>

    <div  style={{
      width: '100%',
      height: "100%",
      boxSizing: 'border-box',
      backgroundImage: `radial-gradient(circle at 60% 60%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 33%, rgba(214,214,29,.05) 40%, rgba(0,0,0,0) 50%, rgba(0,0,0,0) 100%)`,
      backgroundSize: 'cover',
      zIndex: 4,
      position: 'absolute',
      top: 0,
      left: 0,
      }}>

      &nbsp;
    </div>
 
    <div  style={{
      width: '100%',
      height: "100%",
      boxSizing: 'border-box',
      backgroundImage: `radial-gradient(circle at 60% 60%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,.6) 100%)`,
      backgroundSize: 'cover',
      zIndex: 5,
      position: 'absolute',
      top: 0,
      left: 0,
      }}>

      &nbsp;
    </div>
 
	
      {/* <Background2 style={{

      }} /> */}
    </div>
  )
}

