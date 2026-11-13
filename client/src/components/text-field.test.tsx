import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from '@/components/text-field';

describe('TextField', () => {
  it('relie le label au champ', () => {
    render(<TextField label="Email" type="email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  });

  it("n'est ni invalide ni décrit sans aide ni erreur", () => {
    render(<TextField label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it("annonce l'aide comme description du champ", () => {
    render(<TextField label="Mot de passe" hint="12 caractères minimum." />);
    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription(
      '12 caractères minimum.',
    );
  });

  it("marque le champ invalide et y relie l'erreur, en plus de l'aide", () => {
    render(
      <TextField
        label="Mot de passe"
        hint="12 caractères minimum."
        error="Mot de passe trop court."
      />,
    );
    const input = screen.getByLabelText('Mot de passe');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(
      '12 caractères minimum. Mot de passe trop court.',
    );
  });

  it('transmet les autres props au champ', () => {
    render(
      <TextField
        label="Nom"
        autoComplete="family-name"
        defaultValue="Martin"
      />,
    );
    const input = screen.getByLabelText('Nom');
    expect(input).toHaveValue('Martin');
    expect(input).toHaveAttribute('autocomplete', 'family-name');
  });
});
