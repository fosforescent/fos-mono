import {
  EnvelopeClosedIcon
} from '@radix-ui/react-icons'


export default function Contact() {
    

  return (
    <div   style={{
      width: '100%',
      display: "grid",
      gridTemplateColumns: "1fr 1fr", 
      boxSizing: 'border-box',
    }}>
      <h3 style={{
        gridColumn: "1/3",
      }}>Contact</h3>
      <div style={{
        padding: '5px 10px'
      }}>
        <span > Mail: <a className={`text-popover-foreground inline-block`}><EnvelopeClosedIcon /></a></span>
      </div>
      <div style={{
        padding: '5px 10px'
      }}>
        <span > Mail: <a className={`text-popover-foreground inline-block`}><EnvelopeClosedIcon /></a></span>
      </div>
      <div style={{
        padding: '5px 10px'
      }}>
        <span > Mail: <a className={`text-popover-foreground inline-block`}><EnvelopeClosedIcon /></a></span>
      </div>
    </div>
  )
}

