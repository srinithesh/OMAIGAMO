import React, { useMemo } from 'react';
import { BoltIcon, WarningIcon, DocumentTextIcon } from './Icons';

interface AiFleetRecommendationsProps {
  suggestions: string;
}

interface ParsedSuggestions {
  title: string;
  recommendations: string[];
}

const AiFleetRecommendations: React.FC<AiFleetRecommendationsProps> = ({ suggestions }) => {
  const parsedSuggestions = useMemo((): ParsedSuggestions[] => {
    if (!suggestions) return [];
    
    // Define the sections we expect from the AI.
    const sections = ["Immediate Actions", "Policy Recommendations", "Potential Risks"];
    const parsedData: ParsedSuggestions[] = [];
    
    let remainingText = suggestions;
    
    sections.forEach((sectionTitle, index) => {
      // Find the start of the current section.
      const startIndex = remainingText.indexOf(sectionTitle);
      if (startIndex === -1) return;

      // Find the start of the next section to define the end of the current one.
      const nextSectionTitle = sections[index + 1];
      const endIndex = nextSectionTitle ? remainingText.indexOf(nextSectionTitle, startIndex) : remainingText.length;
      
      // Extract the content for the current section.
      const sectionContent = remainingText.substring(startIndex + sectionTitle.length, endIndex).trim();
      
      // Split the content into bullet points.
      const recommendations = sectionContent
        .split(/[\n•*-]+/) // Split by newlines, bullets, asterisks, or hyphens
        .map(line => line.trim())
        .filter(line => line.length > 0); // Remove empty lines
        
      if (recommendations.length > 0) {
        parsedData.push({
          title: sectionTitle,
          recommendations,
        });
      }
    });

    // Handle case where parsing fails and just show the text split by lines
    if(parsedData.length === 0 && suggestions.length > 0){
        return [{
            title: "General Recommendations",
            recommendations: suggestions.split('\n').filter(l => l.trim().length > 0)
        }]
    }

    return parsedData;
  }, [suggestions]);
  
  const getIconForSection = (title: string) => {
    switch (title) {
      case "Immediate Actions":
        return <BoltIcon className="w-6 h-6 text-caribbean-green" />;
      case "Policy Recommendations":
        return <DocumentTextIcon className="w-6 h-6 text-pistachio" />;
      case "Potential Risks":
        return <WarningIcon className="w-6 h-6 text-yellow-400" />;
      default:
        return null;
    }
  };

  if (parsedSuggestions.length === 0) {
    return <p className="text-stone">No specific suggestions provided.</p>;
  }

  return (
    <div className="space-y-6 text-sm max-h-80 overflow-y-auto pr-2">
      {parsedSuggestions.map(({ title, recommendations }) => (
        <div key={title}>
          <h4 className="flex items-center gap-3 font-bold text-lg text-anti-flash-white mb-3 border-b border-bangladesh-green/30 pb-2">
            {getIconForSection(title)}
            <span>{title}</span>
          </h4>
          <ul className="space-y-2 pl-6">
            {recommendations.map((rec, index) => (
              <li key={index} className="relative pl-4 text-anti-flash-white/90">
                <span className="absolute left-0 top-1.5 w-1.5 h-1.5 bg-caribbean-green rounded-full"></span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default AiFleetRecommendations;