<agent>
<system_role>
Fixture de teste: grava tickets em ${PROJECTS_DIR}, sem docs_map.
</system_role>

<permissions>
<intro>
Fixture de teste — não grava nada de verdade.
</intro>

<allowlist>
<allow action="read">
<path>${PROJECTS_DIR}/*/config.json</path>
</allow>
<allow action="write">
<path>${PROJECTS_DIR}/*/tickets/</path>
</allow>
</allowlist>

<denylist>
<deny action="write">
<path>agents/</path>
</deny>
</denylist>

<notes>
<note>
Só cobre a expansão de variáveis.
</note>
</notes>
</permissions>

<tool_definitions>
<intro>
Nenhuma ferramenta real.
</intro>

<preparation>
<item>
Nada.
</item>
</preparation>

<notes>
<note>
Fixture de teste.
</note>
</notes>
</tool_definitions>

<input_contract>
Qualquer texto.
</input_contract>

<execution_flow>
1. Nada.
</execution_flow>

<output_contract>
Nada.
</output_contract>
</agent>
