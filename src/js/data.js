const ALAGA_DATA = [
  {
    id: 1,
    title: "Av. Torquato Tapajós",
    neighborhood: "Flores",
    type: "alagamento",
    criticality: "critico",
    score: 92,
    lat: -3.0633,
    lng: -60.0171,
    date: "2026-09-05",
    status: "em_atendimento",
    description: "Ponto recorrente com forte acúmulo de água em períodos de chuva intensa."
  },
  {
    id: 2,
    title: "Av. Brasil",
    neighborhood: "Compensa",
    type: "alagamento",
    criticality: "alto",
    score: 81,
    lat: -3.1139,
    lng: -60.0666,
    date: "2026-09-03",
    status: "em_analise",
    description: "Trecho com drenagem insuficiente e impacto no fluxo de veículos."
  },
  {
    id: 3,
    title: "Av. Max Teixeira",
    neighborhood: "Cidade Nova",
    type: "residuo",
    criticality: "medio",
    score: 64,
    lat: -3.0326,
    lng: -59.9854,
    date: "2026-08-27",
    status: "em_analise",
    description: "Acúmulo frequente de resíduos próximo a área de circulação."
  },
  {
    id: 4,
    title: "Rua do Comércio",
    neighborhood: "Jorge Teixeira",
    type: "residuo",
    criticality: "alto",
    score: 78,
    lat: -3.0590,
    lng: -59.9395,
    date: "2026-08-20",
    status: "em_atendimento",
    description: "Descarte irregular próximo a igarapé, com risco de obstrução."
  },
  {
    id: 5,
    title: "Av. Autaz Mirim",
    neighborhood: "São José Operário",
    type: "alagamento",
    criticality: "critico",
    score: 89,
    lat: -3.0782,
    lng: -59.9399,
    date: "2026-09-06",
    status: "em_analise",
    description: "Alagamento recorrente com impacto em residências e acesso local."
  },
  {
    id: 6,
    title: "Av. Djalma Batista",
    neighborhood: "Chapada",
    type: "alagamento",
    criticality: "medio",
    score: 58,
    lat: -3.1028,
    lng: -60.0262,
    date: "2026-07-14",
    status: "resolvido",
    description: "Ocorrência pontual com intervenção concluída."
  },
  {
    id: 7,
    title: "Rua Principal",
    neighborhood: "Redenção",
    type: "residuo",
    criticality: "baixo",
    score: 34,
    lat: -3.0721,
    lng: -60.0398,
    date: "2026-08-30",
    status: "resolvido",
    description: "Ponto de descarte irregular de menor impacto, já atendido."
  },
  {
    id: 8,
    title: "Av. Noel Nutels",
    neighborhood: "Cidade Nova",
    type: "alagamento",
    criticality: "alto",
    score: 76,
    lat: -3.0199,
    lng: -59.9935,
    date: "2026-09-01",
    status: "em_atendimento",
    description: "Trecho com recorrência moderada e interrupção parcial de tráfego."
  }
];

const CRITICALITY_LABELS = {
  critico: { label: "Crítico", icon: "!" },
  alto: { label: "Alto", icon: "!" },
  medio: { label: "Médio", icon: "●" },
  baixo: { label: "Baixo", icon: "✓" }
};

const STATUS_LABELS = {
  em_analise: "Em análise",
  em_atendimento: "Em atendimento",
  resolvido: "Resolvido"
};
