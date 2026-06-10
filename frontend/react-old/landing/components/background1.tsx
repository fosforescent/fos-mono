import { useRef, useState, useEffect } from 'react'   

// import { useIsScrolling } from '@/components/use-scroll'

const Background1 = () => {
  //http://creativejs.com/2011/12/day-3-play-with-your-pixels/

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [iteration, setIteration] = useState(0);
    

  // const {
  //   yScrollFraction,
  //   isScrolling
  // } = useIsScrolling();
    



  // useEffect(() => {
  //   const listener = () => {
  //     iteration < 0 && setIteration(0);
  //   }
  //   document.getElementById("main")?.addEventListener('scroll', listener)

  //   return () => {
  //     document.getElementById("main")?.removeEventListener('scroll', listener)
  //   }
  // }, [iteration])


  useEffect(() => {

    const numIterations = 27
    // console.log('iteration', iteration, numIterations)

    if (iteration < 0){
      return 
    }

    if (iteration > numIterations ){
      // setIteration(-1)
      return
    }


    if (!canvasRef.current) {
      throw new Error('no canvas')
    }
    const context = canvasRef.current.getContext('2d', { willReadFrequently: true })

    if (!context) {
      throw new Error('no context')
    }

    const imagedata = context?.getImageData(0, 0, canvasRef.current?.width, canvasRef.current.height);

    if (!imagedata) {
      throw new Error('no imagedata')
    }

    const setPixel = (imagedata: ImageData, x: number, y: number, r: number, g: number, b: number, a: number) => {
      let i = (y * imagedata.width + x) * 4;
      imagedata.data[i++] = r;
      imagedata.data[i++] = g;
      imagedata.data[i++] = b;
      imagedata.data[i] = a;
    }
    

    for( let y = 0 ; y < imagedata.height; y++ ) {
      for( let x = 0 ; x < imagedata.width; x++ ) {
        // set the colour randomly
        const heightFrac = y / imagedata.height;
        const yScrollFraction = .7
        if(Math.random() * 2  < 1.5){
        // if(true){
          setPixel(imagedata, x, y, 
              Math.floor((Math.random() * 55 )  + (100 * (1- yScrollFraction )) + (100 * (heightFrac))), 
              Math.floor((Math.random() * 55)   + (100 * ( yScrollFraction )) + (100 * (1- heightFrac))  ),
              Math.floor((Math.random() * 55)   + (100 * ( yScrollFraction )) + (100 * (1- heightFrac)) ), 
              Math.floor((Math.random() * 15) + 200)
            );
        }else{
          setPixel(imagedata, x, y, 
            Math.floor((Math.random() * 0 ) + 15), 
            Math.floor((Math.random() * 5) + 30 ),
            Math.floor((Math.random() * 1) + 19), 
            Math.floor((Math.random() * 0) + 255));
        }
      }
    }
    context.putImageData(imagedata, 0, 0);
    const nextInterval =  (Math.tanh(iteration / numIterations) * 300 )
    // console.log('nextInterval', nextInterval)
    setTimeout(() => setIteration(iteration + 1), nextInterval)
    return () => {  }
  }, [iteration])


  

  return <canvas ref={canvasRef} id="canvas" width={Math.floor(window.innerWidth / 54)} height="1000" style={{
    'position': 'absolute',
    'top': '0',
    'left': '0',
    'zIndex': '-3',
    'opacity': '.7',
    'backgroundColor': '#333',
    'width': "100%",
    'height': "100%",
  }}></canvas>

}



export default Background1