import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  // SheetDescription,
  // SheetOverlay,
  // SheetHeader,
  // SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Button,
} from "@/components/ui/button"


import {
  HamburgerMenuIcon,
  GitHubLogoIcon,
  // EnvelopeClosedIcon,
  // FileTextIcon,
  // PersonIcon,
  // MagicWandIcon,
  HomeIcon
} from '@radix-ui/react-icons'


export default function NavBar() {

  const classFunc = ({ isActive, isPending }: {isActive: boolean, isPending: boolean}) =>
    isActive
      ? "active"
      : isPending
      ? "pending"
      : ""

    const [open, setOpen] = useState(false);
  return (
    <div style={{
      padding: '5px 6vw',
      position: 'relative',
      zIndex: 7,
    }}>
      <Sheet  open={open} onOpenChange={setOpen}  >
        <SheetTrigger asChild>
          <Button variant="ghost" className="hover:bg-whispyblue/5" style={{
            zIndex: 9,
          }} ><><HamburgerMenuIcon /> &nbsp; Menu</></Button> 
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px] bg-gradient-radial from-green-400/5 via-cyan-900/5 to-blue-500/10 border-whispyblue/10">
          {/* <SheetHeader>
            <SheetTitle>Where to?</SheetTitle>
          </SheetHeader> */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            boxSizing: 'border-box',
            paddingBottom: "2rem",
            height: "100%",
          }}>
            <p>
              <Button variant="ghost" className="hover:bg-whispyblue/5" >
                <NavLink to="/" reloadDocument className={classFunc} onClick={() => setOpen(false)}> Home <HomeIcon className="inline text-fosorange" /></NavLink>
              </Button>
            </p>
            <p>
              <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <NavLink to="/about" reloadDocument className={classFunc} onClick={() => setOpen(false)}> About </NavLink>
              </Button>
            </p>
            <p>
              <Button variant="ghost" className="hover:bg-whispyblue/5" >
              {/* <a className={`text-popover-foreground inline-block drop-shadow-lg`}>Contact</a> */}
                <NavLink to="/uses" reloadDocument className={classFunc} onClick={() => setOpen(false)}> Uses </NavLink>
              </Button>
            </p>
            <p>
              <Button variant="ghost" className="hover:bg-whispyblue/5" >
              {/* <a className={`text-popover-foreground inline-block drop-shadow-lg`}>Contact</a> */}
                <NavLink to="/register" reloadDocument className={classFunc} onClick={() => setOpen(false)}> Register </NavLink>
              </Button>
            </p>
            <p>
              <Button variant="ghost" className="hover:bg-whispyblue/5" >
                <a className={`text-popover-foreground inline-block drop-shadow-lg`} onClick={() => setOpen(false)} target="_blank" href="https://github.com/fosforescent/fosforescent-js"> Github <GitHubLogoIcon className="inline text-fosorange" /></a>
              </Button>
            </p>
            {/* <p>
              <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <a className={`text-popover-foreground inline-block drop-shadow-lg`}>Contribute</a> */}
                {/* <NavLink reloadDocument className={classFunc} > Contribute </NavLink> */}
              {/* </Button>
            </p> */}
          </div>
        </SheetContent>
      </Sheet>

    </div>
  )
  
}