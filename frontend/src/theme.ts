import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: { main: '#CC3D3D', light: '#FF5C5C', dark: '#B82E2E', contrastText: '#fff' },
    secondary: { main: '#241E1C' },
    background: { default: '#FAF8F6', paper: '#FFFFFF' },
    text: { primary: '#241E1C', secondary: '#716963' },
    divider: '#EDE8E4',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Sen, system-ui, sans-serif',
    h4: { fontWeight: 800, letterSpacing: '-1.1px' },
    h5: { fontWeight: 800, letterSpacing: '-0.6px' },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10, padding: '10px 18px' } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true, variant: 'outlined' } },
    MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: '#FFF' } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 20 } } },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: 11,
          fontWeight: 700,
          color: '#716963',
          letterSpacing: '.8px',
          textTransform: 'uppercase',
          backgroundColor: '#FCFBFA',
        },
        root: { borderColor: '#F0ECE8' },
      },
    },
  },
});
