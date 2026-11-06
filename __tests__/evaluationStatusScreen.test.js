import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text, ActivityIndicator } from 'react-native';
import EvaluationSetupScreen from '../src/pages/Auth/EvaluationSetupScreen';
let mockStatus='checking'; const mockRetry=jest.fn();
jest.mock('../src/hooks/useAuth',()=>()=>({evaluation:{status:mockStatus},retrySession:mockRetry}));
jest.mock('../src/hooks/useSpeakOnMount',()=>jest.fn());
jest.mock('../src/hooks/useAccessibility',()=>()=>({highContrast:false,settings:{fontScale:1}}));
jest.mock('../src/ui/MainScreenHeader',()=> 'MainScreenHeader');
jest.mock('../src/ui/AnimatedScreenTransition',()=> 'AnimatedScreenTransition');
let tree;afterEach(async()=>{if(tree)await act(async()=>tree.unmount());tree=null;});
test.each(['checking','expired','suspended','offline','blocked','unavailable','not-started'])('%s has only automatic evaluation status and no manual setup controls',async status=>{
  mockStatus=status;await act(async()=>{tree=Renderer.create(<EvaluationSetupScreen/>);});
  const labels=tree.root.findAllByType(Text).map(n=>n.props.children).filter(s=>typeof s==='string').join(' ');
  expect(labels).not.toMatch(/Configurar aparelho|Importar|Código|senha|e-mail|cadastro/i);
  if(status==='checking')expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  else expect(labels).toContain('Tentar novamente');
});
