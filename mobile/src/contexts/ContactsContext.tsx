import React from 'react';

type ContactsContextType = {
  onUpdatePress: () => void;
};

export const ContactsContext = React.createContext<ContactsContextType>({
  onUpdatePress: () => {}
});

export const ContactsProvider: React.FC<{onUpdatePress: () => void; children: React.ReactNode}> = ({ 
  onUpdatePress, 
  children 
}) => {
  return (
    <ContactsContext.Provider value={{ onUpdatePress }}>
      {children}
    </ContactsContext.Provider>
  );
};
