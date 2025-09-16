import { useEffect, useRef, useState } from 'react';

export const useScrollAnimation = <T extends HTMLElement = HTMLDivElement>(threshold = 0.1) => {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold]);

  return { ref, isVisible };
};

export const useCountUp = (end: number, duration = 2000, start = 0) => {
  const [count, setCount] = useState(start);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      setCount(Math.floor(start + (end - start) * progress));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isActive, end, duration, start]);

  return { count, setIsActive };
};