

import { Outlet } from "react-router-dom";
import NavBar from "@/components/navbar";

import Background1 from '@/components/background1'

import { Button } from "@/components/ui/button"

import {
  ChevronUpIcon,
  // ChevronDownIcon
} from "@radix-ui/react-icons"
// import { useIsScrolling } from "./components/use-scroll";


function App( { children } : { children?: React.ReactNode }) {


  // console.log('App.tsx', document.body.clientHeight, window.innerHeight )
  // const isScrolling = useIsScrolling()
  // useEffect(() => {
  //   console.log('current section', current, position)
  //   if(current === ''){
  //     document.getElementById("scroll-up-button")?.classList.add('hidden')
  //   } else {
  //     document.getElementById("scroll-up-button")?.classList.remove('hidden')
  //   }

  //   if (current === 'register'){
  //     document.getElementById("scroll-down-button")?.classList.add('hidden')
  //   }else {
  //     document.getElementById("scroll-down-button")?.classList.remove('hidden')
  //   }
  // }, [isScrolling])

  return (
    <div style={{
      position: 'relative',
      height: '100%',
      width: '100%',
      padding: '0',
      margin: '0',
    }} className="app-container">
      <div style={{
        width: '100%',
        height: '50px',
        position: 'fixed',
        zIndex: 3,
      }}>
        <NavBar />
      </div>

      {/* <div style={{
        width: '100%',
        height: '50px',
        padding: '20px',
        position: 'fixed',
        zIndex: 2,
        textAlign: 'center',
      }} className="content-center hidden" id="scroll-up-button" onClick={() => window.scrollBy(-10, 0)}>
        <div style={{
          margin: '0 auto',
          textAlign: 'center',
          width: '30px',
          fontSize: '30px',
        }}><ChevronUpIcon height='20px' width='20px'/></div>
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
      </div> */}
      <div id="main" className="main content-container" style={{
        position: 'relative',
        width: '100vw',
        paddingTop: '0',
        paddingBottom: '0',
        margin: '0',
        boxSizing: 'border-box',
        scrollSnapType: 'y mandatory',
        overflowY: 'scroll',
        overflowX: 'hidden',
        scrollBehavior: 'smooth'
  
      }}>
        { children ?? <Outlet /> }
      </div>

      <div className="footer" style={{
        height: '50px',
        width: '100%',
        padding: '0 6vw',
        display: 'none',

      }}>
        <div style={{
          display: document.body.clientHeight > window.innerHeight ? 'block' : 'none',
        }}><Button variant="link" onClick={() =>{ 
          window.scrollTo({ 
            top: 0,  
            behavior: 'smooth'
            /* you can also use 'auto' behaviour 
              in place of 'smooth' */
          }); 
        }} className='text-popover-foreground'>
        <ChevronUpIcon /> scroll to top</Button></div>
      </div>
      <Background1 />
    </div>
  )
}

export default App
