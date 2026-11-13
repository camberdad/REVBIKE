export class BikeAudio {
  enabled=false;
  private context?:AudioContext;
  private oscillator?:OscillatorNode;
  private gain?:GainNode;
  setEnabled(enabled:boolean){
    this.enabled=enabled;
    if(enabled && !this.context){
      this.context=new AudioContext();this.oscillator=this.context.createOscillator();this.gain=this.context.createGain();
      this.oscillator.type='sawtooth';this.oscillator.frequency.value=38;this.gain.gain.value=0;
      const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=330;
      this.oscillator.connect(filter);filter.connect(this.gain);this.gain.connect(this.context.destination);this.oscillator.start();
    }
    if(enabled)void this.context?.resume();else if(this.gain)this.gain.gain.value=0;
  }
  update(speed:number,gas:boolean,active:boolean){
    if(!this.enabled || !this.context || !this.gain || !this.oscillator)return;
    this.oscillator.frequency.setTargetAtTime(34+Math.min(100,Math.abs(speed)*1.3)+(gas?22:0),this.context.currentTime,0.09);
    this.gain.gain.setTargetAtTime(active?(gas?0.022:0.01):0,this.context.currentTime,0.08);
  }
  explosion(){
    if(!this.enabled || !this.context)return;
    const ctx=this.context,buffer=ctx.createBuffer(1,ctx.sampleRate*0.35,ctx.sampleRate),samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length)**2;
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;gain.gain.value=0.15;
    source.connect(gain);gain.connect(ctx.destination);source.start();
  }
}
