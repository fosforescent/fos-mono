
import { useRef, useEffect, useState } from 'react'   


export default function Background2 ({ style } : { style ? : React.CSSProperties }) {

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isAnimating, setIsAnimating] = useState(false);
        
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

  
    useEffect(() => {
      if(canvasRef.current){
        const canvas = canvasRef.current;
        if(canvas){
          if(!isAnimating){
            setIsAnimating(true);
            animateCanvas(canvas, setIsAnimating)
          }
        }
      }
    }, [])
  

  return <canvas ref={canvasRef} id="canvas" width={windowWidth } height={windowHeight } style={{
    'position': 'absolute',
    'top': '0',
    'left': '0',
    'opacity': '1',
    'backgroundColor': 'transparent',
    'width': "100%",
    'height': "100%",
    ...style
  }}></canvas>
}


type Particle = {
  x: number,
  y: number,
  vx: number,
  vy: number,
  size: number,
  color: string,
  life: number,
}


const animateCanvas = (canvas: HTMLCanvasElement, setIsAnimating: ( val: boolean) => void) => {
  const context = canvas.getContext('2d');
  
  const generateParticles = (amount: number, width: number, height: number) => Array(amount).fill({}).map(() => generateParticle(width, height))

  function generateParticle(width: number, height: number): Particle {

    const tieBreaker = Math.floor(Math.random() * 3);

    const tryR = Math.random() > .5;
    const tryG = Math.random() > .5;
    const tryB = Math.random() > .5;

    const doR = (tryR && tryG && tryB) ? tieBreaker !== 0 : (!tryR && !tryG && !tryB) ? tieBreaker === 0 : tryR;
    const doG = (tryR && tryG && tryB) ? tieBreaker !== 1 : (!tryR && !tryG && !tryB) ? tieBreaker === 1 : tryG;
    const doB = (tryR && tryG && tryB) ? tieBreaker !== 2 : (!tryR && !tryG && !tryB) ? tieBreaker === 2 : tryB;

    console.log(tryR, tryG, tryB, tieBreaker)
    console.log(doR, doG, doB, tieBreaker)

    const randomColor = `rgba(${
      doR ? Math.random() * 55 + 200 : Math.random() * 55 
    }, ${
      doG ? Math.random() * 10 + 245 : Math.random() * 55 
    }, ${
      doB ? Math.random() * 55 + 200 : Math.random() * 55 
    }, ${
      Math.random() / 2 + .5
    })`

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.random() * 2 - 1,
      vy: Math.random() * 2 - 1,
      size: Math.random() * 2 + 1,
      color: randomColor,
      life: Math.random() * 100,
    }
  }


  function updateParticle(particle: Particle){
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life--;

    return particle;
  }

  function drawParticle(context: CanvasRenderingContext2D, particle: Particle){
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.closePath();
    context.fillStyle = particle.color;
    context.fill();
  }
  
  function animate(context: CanvasRenderingContext2D, nextTime: number, particles: Particle[]): void {

    context.clearRect(0, 0, canvas.width, canvas.height);
    const newParticles = particles.map(updateParticle).filter(particle => {
      return particle.life > 0
    });


    // const newNextTime = (((nextTime - 140) ) + 150);
    if (newParticles.length > 0){
      for (const particle of newParticles) {
        drawParticle(context, particle);
      }
      setTimeout(() => animate(context, nextTime, newParticles), nextTime);  
    }else {
      setIsAnimating(false);
    }
  }

  // function makeTestCircle(context: CanvasRenderingContext2D){
  //   context.beginPath();
  //   context.arc(100, 100, 50, 0, Math.PI * 2);
  //   context.closePath();
  //   context.fillStyle = 'red';
  //   context.fill();
  // }

  if (!context) {
    return
  }else{
    const startParticles = generateParticles(100, canvas.width, canvas.height)
    animate(context, 60, startParticles);
    // makeTestCircle(context);
  }

}