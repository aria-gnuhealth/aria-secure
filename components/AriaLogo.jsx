import Svg, { Circle, Path, Line, Text, Defs, ClipPath } from "react-native-svg";

export default function AriaLogo({ size = 100 }) {
  const scale = size / 120;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <ClipPath id="clip">
          <Circle cx="60" cy="55" r="40"/>
        </ClipPath>
      </Defs>

      {/* Fond */}
      <Circle cx="60" cy="55" r="40" fill="#0A2A3F"/>
      <Circle cx="60" cy="55" r="40" fill="none" stroke="#1F6B9E" strokeWidth="1.5"/>

      {/* Poumon gauche */}
      <Path
        d="M48 42 C42 40 36 44 35 52 C34 60 35 72 38 78 C40 82 44 84 47 82 C50 80 51 75 52 68 C53 61 53 54 52 46 Z"
        fill="#1F6B9E"
        opacity="0.9"
        clipPath="url(#clip)"
      />

      {/* Poumon droit */}
      <Path
        d="M72 42 C78 40 84 44 85 52 C86 60 85 72 82 78 C80 82 76 84 73 82 C70 80 69 75 68 68 C67 61 67 54 68 46 Z"
        fill="#1F6B9E"
        opacity="0.9"
        clipPath="url(#clip)"
      />

      {/* Trachée */}
      <Path d="M60 28 L60 40" stroke="#2980B9" strokeWidth="3" strokeLinecap="round"/>
      {/* Bronches */}
      <Path d="M60 40 C56 43 50 46 48 48" stroke="#2980B9" strokeWidth="2" strokeLinecap="round"/>
      <Path d="M60 40 C64 43 70 46 72 48" stroke="#2980B9" strokeWidth="2" strokeLinecap="round"/>

      {/* Bronchioles */}
      <Path d="M48 48 C45 53 42 57 41 63" stroke="#2980B9" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
      <Path d="M72 48 C75 53 78 57 79 63" stroke="#2980B9" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>

      {/* Points IA */}
      <Circle cx="41" cy="63" r="1.8" fill="#5BA8D4"/>
      <Circle cx="79" cy="63" r="1.8" fill="#5BA8D4"/>
      <Circle cx="60" cy="58" r="1.5" fill="#7EC8E3"/>

      {/* Lignes scanning */}
      <Line x1="20" y1="55" x2="100" y2="55" stroke="#1F6B9E" strokeWidth="0.5" opacity="0.3"/>
    </Svg>
  );
}
