
var AMR={toWAV:(function(amr){var decoded=this._decode(amr);
    if(!decoded){return null}var raw=new Uint8Array(decoded.buffer,decoded.byteOffset,decoded.byteLength);var out=new Uint8Array(raw.length+this.WAV_HEADER_SIZE);var offset=0;var write_int16=(function(value){var a=new Uint8Array(2);(new Int16Array(a.buffer))[0]=value;out.set(a,offset);offset+=2});var write_int32=(function(value){var a=new Uint8Array(4);(new Int32Array(a.buffer))[0]=value;out.set(a,offset);offset+=4});var write_string=(function(value){var d=(new TextEncoder("utf-8")).encode(value);out.set(d,offset);offset+=d.length});write_string("RIFF");write_int32(4+8+16+8+raw.length);write_string("WAVEfmt ");write_int32(16);var bits_per_sample=16;var sample_rate=8e3;var channels=1;var bytes_per_frame=bits_per_sample/8*channels;var bytes_per_sec=bytes_per_frame*sample_rate;write_int16(1);write_int16(1);write_int32(sample_rate);write_int32(bytes_per_sec);write_int16(bytes_per_frame);write_int16(bits_per_sample);write_string("data");write_int32(raw.length);out.set(raw,offset);return out})}




