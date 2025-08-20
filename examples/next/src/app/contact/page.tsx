import { metadataClient } from '@/generate-metadata';

export const generateMetadata = metadataClient.getMetadata(() => {
  return {
    path: '/contact',
  };
});

export default function Contact() {
  return (
    <div>
      <h1>Contact</h1>
    </div>
  );
}
