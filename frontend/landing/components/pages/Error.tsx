// import React, { useEffect, useRef } from 'react'
import { Link } from "react-router-dom";
// import Section from '../section'

import { buttonVariants } from "@/components/ui/button"

// import {
//   Button,
// } from "@/components/ui/button"

export default function ErrorPage() {
    

  return (
    <div  className="grid grid-cols-1 lg:grid-cols-2" style={{
      width: '100%',
      padding: '0 3vw',
      boxSizing: 'border-box',
      position: 'relative',
      textAlign: 'center',
    }}>
        Sorry, your page was not found.  You might find what you're looking for <Link to="/" reloadDocument  className={buttonVariants({ variant: "link" })} >here</Link>

    </div>
  )
}
