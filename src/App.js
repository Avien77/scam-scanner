//import logo from './logo.svg';
import './App.css';
import ScrollStack, { ScrollStackItem } from './ScrollStack'
import CardNav from './CardNav'
import logo from './logo.svg';


function App() {
  const items = [
    {
      label: "Welcome Back",
      bgColor: "#0D0716",
      textColor: "#fff",
      links: [
        { label: "Login", ariaLabel: "About Company" },
        { label: "Sign Up", ariaLabel: "About Careers" }
      ]
    },
    {
      label: "Scans", 
      bgColor: "#170D27",
      textColor: "#fff",
      links: [
        { label: "Scan Now", ariaLabel: "Featured Projects"},
        { label: "Past Scans", ariaLabel: "Project Case Studies" }
      ]
    },
    {
      label: "Developed by:",
      bgColor: "#271E37", 
      textColor: "#fff",
      links: [
        { label: "Pablo Avila", ariaLabel: "Pablo", icon: 'avien77pfp.png', href: 'https://github.com/Avien77'},
        { label: "Aiden Bariac", ariaLabel: "Aiden", icon: 'aidenPFP.png', href: 'https://github.com/adbaraiac'},
        { label: "Natalie Muscas", ariaLabel: "Natalie", href: 'https://github.com/Avien77' }
      ]
    }
  ];
  return (
    
    <div className="App">
  <CardNav
      logo={logo}
      logoAlt="Company Logo"
      items={items}
      baseColor="#fff"
      menuColor="#000"
      buttonBgColor="#111"
      buttonTextColor="#fff"
      ease="power3.out"
  theme="color"
/>

<ScrollStack>
  <ScrollStackItem>
    <div style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '30%', height: '100%' }}>
    <img src="/exampleScam.png" alt="description" style={{ width: '25%', borderRadius: '12px', objectFit: 'cover' }} />
    <div>
      <h2>Is this a scam?</h2>
      <p>Scam Scanner Finds Out For You!</p>
    </div>
  </div>
  </ScrollStackItem>
  <ScrollStackItem>
    <div style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '30%', height: '100%' }}>
    <img src="/graph.jpg" alt="description" style={{ width: '30%', borderRadius: '12px', objectFit: 'cover' }} />
    <div>
      <h2>How do we work?</h2>
      <p>idk lol</p>
    </div>
  </div>
  </ScrollStackItem>
  <ScrollStackItem>
    <div style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '30%', height: '100%' }}>
    <img src="/exampleScam.png" alt="description" style={{ width: '25%', borderRadius: '12px', objectFit: 'cover' }} />
    <div>
      <h2>Is This a Scam?</h2>
      <p>Scam Scanner Finds Out For You!</p>
    </div>
  </div>
  </ScrollStackItem>
</ScrollStack>
    </div>
  );
}

export default App;
